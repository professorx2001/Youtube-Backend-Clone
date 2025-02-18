import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/apiError.js";
import { User } from "../models/user.model.js";
import { ApiResponse } from "../utils/apiResponse.js";
import fs from "fs";
import jwt from "jsonwebtoken";
import {
  uploadOnCloudinary,
  deleteFromCloudinary,
} from "../utils/cloudinary.js";

const registerUser = asyncHandler(async (req, res) => {
  const { fullname, email, username, password } = req.body;

  // Validation for required fields
  if (
    [fullname, email, username, password].some((field) => field?.trim() === "")
  ) {
    throw new ApiError(400, "All fields are required.");
  }
  // Handling avatar and cover image uploads
  const localAvatarPath = req.files?.avatar?.[0]?.path;
  const localCoverImgPath = req.files?.coverImg?.[0]?.path;

  // Check if the user already exists
  const existingUser = await User.findOne({
    $or: [{ username: username.toLowerCase() }, { email }],
  });
  if (existingUser) {
    fs.unlinkSync(localAvatarPath);
    fs.unlinkSync(localCoverImgPath);
    throw new ApiError(
      409,
      "A user with the same email or username already exists."
    );
  }

  if (!localAvatarPath) {
    throw new ApiError(400, "Avatar file is required.");
  }

  let avatar;

  try {
    // Upload avatar to Cloudinary
    const avatarResponse = await uploadOnCloudinary(localAvatarPath);
    avatar = avatarResponse;

    console.log("Uploaded avatar:", avatar.secure_url);
  } catch (error) {
    console.error("Error uploading avatar to Cloudinary:", error);
    throw new ApiError(500, "Failed to upload avatar.");
  }
  let coverImage;
  try {
    // Upload cover image to Cloudinary (if provided)
    if (localCoverImgPath) {
      const coverImgResponse = await uploadOnCloudinary(localCoverImgPath);
      coverImage = coverImgResponse;

      console.log("Uploaded cover image:", coverImage.secure_url);
    }
  } catch (error) {
    console.error("Error uploading cover image to Cloudinary:", error);
    // Cleanup uploaded avatar before throwing error
    if (avatar?.public_id) {
      await deleteFromCloudinary(avatar.public_id);
    }
    throw new ApiError(500, "Failed to upload cover image.");
  }

  // Creating the new user
  try {
    const newUser = await User.create({
      username: username.toLowerCase(),
      email,
      fullname,
      avatar: avatar.secure_url,
      coverImage: coverImage?.secure_url || "",
      password,
    });

    // Fetching the created user without sensitive fields
    const createdUser = await User.findById(newUser._id).select(
      "-password -refreshToken -watchHistory"
    );

    if (!createdUser) {
      throw new ApiError(500, "Something went wrong while fetching the user.");
    } else {
      console.log("User Created Successfully");
    }

    // Sending the response
    return res
      .status(200)
      .json(new ApiResponse(200, createdUser, "User registered successfully."));
  } catch (error) {
    console.error("User creation failed:", error);

    // Cleanup uploaded files in case of failure
    if (avatar?.public_id) {
      await deleteFromCloudinary(avatar.public_id);
    }
    if (coverImage?.public_id) {
      await deleteFromCloudinary(coverImage.public_id);
    }

    throw new ApiError(
      500,
      "Failed to register user. Uploaded images have been deleted."
    );
  }
});

const generateAccessAndRefreshToken = async (userId) => {
  try {
    const user = await User.findById(userId);

    const accessToken = user.generateAccessToken();
    const refreshToken = user.generateRefreshToken();

    user.refreshToken = refreshToken;

    await user.save({ validateBeforeSave: false });

    return { accessToken, refreshToken };
  } catch (error) {
    console.error("Error generating access token and refresh token:", error);
    throw new ApiError(
      500,
      "Something went wrong while generating access token and refresh token."
    );
  }
};

const loginUser = asyncHandler(async (req, res) => {
  const { email, username, password } = req.body;

  if ((!email && !username) || !password) {
    throw new ApiError(400, "Email or username and password are required.");
  }

  try {
    const user = await User.findOne({ $or: [{ username }, { email }] });

    if (!user) {
      throw new ApiError(404, "User not found.");
    }

    const isPasswordValid = await user?.isPasswordCorrect?.(password);
    console.log(`Password found ${isPasswordValid}`);
    
    if (!isPasswordValid) {
      throw new ApiError(401, "Invalid credentials.");
    }

    // Generate access and refresh tokens
    const { accessToken, refreshToken } = await generateAccessAndRefreshToken(user._id);

    const loggedInUser = await User.findById(user._id).select("-password -refreshToken -watchHistory");

    if (!loggedInUser) {
      throw new ApiError(500, "Something went wrong while fetching the user.");
    }

    const options = {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "Strict",
    };

    return res
      .status(200)
      .cookie("accessToken", accessToken, options)
      .cookie("refreshToken", refreshToken, options)
      .json(new ApiResponse(200, { user: loggedInUser, accessToken, refreshToken }, "Login successful."));
  } catch (error) {
    console.error("Login failed:", error);
    throw new ApiError(500, "Something went wrong while logging in.");
  }
});


const logoutUser = asyncHandler(async (req, res) => {
  const id = req.user._id;
  await User.findByIdAndUpdate(id, {
    $set: { refreshToken: undefined },
  }, { new: true }); //return fresh information

  const options = {
    httpOnly: true,
    secure: false,
  };
  return res
    .status(200)
    .clearCookie("accessToken", "", options)
    .clearCookie("refreshToken", "", options)
    .json(new ApiResponse(200, {}, "Logout successful."));
});

const refressAccessToken = asyncHandler(async (req, res) => {
  const incomingRefreshToken =
    req.cookies.refreshToken || req.body.refreshToken;

  if (!incomingRefreshToken) {
    throw new ApiError(401, "Refresh token not found.");
  }

  try {
    const decodedToken = jwt.verify(
      incomingRefreshToken,
      process.env.REFRESH_TOKEN_SECRET
    );

    const user = await User.findById(decodedToken?._id);
    if (!user) {
      throw new ApiError(404, "Invalid refresh token");
    }
    if (incomingRefreshToken !== user.refreshToken) {
      throw new ApiError(401, "Invalid refresh token");
    }

    const options = {
      httpOnly: true,
      secure: false,
    };
    const { accessToken, refreshToken: newRefreshToken } =
      await generateAccessAndRefreshToken(user?._id);

    return res
      .status(200)
      .cookie("accessToken", accessToken, options)
      .cookie("refreshToken", newRefreshToken, options)
      .json(
        new ApiResponse(
          200,
          {
            accessToken,
            refreshToken: newRefreshToken,
          },
          "Access Token refreshed successfully."
        )
      );
  } catch (error) {
    throw new ApiError(500, "Access token refresh failed.");
  }
});

const changeCurrentPassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  if ([currentPassword, newPassword].some((field) => field?.trim() === "")) {
    throw new ApiError(400, "All fields are required.");
  } 

  try {
    const user = await User.findById(req.user._id);

    if (!user) {
      throw new ApiError(404, "User not found.");
    } 

    const isPasswordValid = await user.isPasswordCorrect(currentPassword);

    if (!isPasswordValid) {
      throw new ApiError(401, "Invalid current password.");
    }

    user.password = newPassword;
    await user.save({validateBeforeSave: false});

    return res.status(200).json(new ApiResponse(200, {}, "Password changed successfully."));
  } catch (error) {
    console.error("Password change failed:", error);
    throw new ApiError(500, "Something went wrong while changing the password.");
  }
})

const getUserProfile = asyncHandler(async (req, res) => {
  const id = req.user._id;
  const user = await User.findById(id).select("-password -refreshToken -watchHistory");
  if (!user) {
    throw new ApiError(404, "User not found.");
  }
  return res.status(200).json(new ApiResponse(200, user, "User profile fetched successfully."));
}); 

const updateAccountDetails = asyncHandler(async (req, res) => {
  const {fullname, email} = req.body
  if ([fullname, email].some((field) => field?.trim() === "")) {
    throw new ApiError(400, "All fields are required.");
  } 
  const id = req.user._id;
  const user = await User.findById(id);
  if (!user) {
    throw new ApiError(404, "User not found.");
  }
  user.fullname = fullname;
  user.email = email;
  await user.save({validateBeforeSave: false});
  return res.status(200).json(new ApiResponse(200, user, "Account details updated successfully."));
});

const updateUserAvatar = asyncHandler(async (req, res) => {
  const id = req.user._id;
  const localAvatarPath = req.file?.avatar?.[0]?.path;
  if (!localAvatarPath) {
    throw new ApiError(400, "Avatar file is required.");
  }

  const avatar = await uploadToCloudinary(localAvatarPath);
  if(!avatar.url){
    throw new ApiError(500, "Avatar upload failed.");
  }
  const user = await User.findByIdAndUpdate(id, 
    { $set : {
      avatar : avatar.url
    }}, { new: true })
    .select("-password -refreshToken -watchHistory");

    return res.status(200).json(new ApiResponse(200, user, "Avatar updated successfully."));
});

const updateUserCoverImage = asyncHandler(async (req, res) => {
  const id = req.user._id;

  const localCoverImgPath = req.file?.coverImg?.[0]?.path;
  if (!localCoverImgPath) {
    throw new ApiError(400, "Cover image file is required.");
  }

  const coverImage = await uploadToCloudinary(localCoverImgPath);
  if(!coverImage.url){
    throw new ApiError(500, "Cover image upload failed.");
  }
  const user = await User.findByIdAndUpdate(id, 
    { $set : {
      coverImage : coverImage.url
    }}, { new: true })
    .select("-password -refreshToken -watchHistory");

    return res.status(200).json(new ApiResponse(200, user, "Cover image updated successfully."));
})

const getWatchHistory = asyncHandler(async (req, res) => {
  // TODO : get watch history
})


export { 
  registerUser,
  loginUser, 
  refressAccessToken, 
  changeCurrentPassword,
  getUserProfile, 
  updateAccountDetails, 
  updateUserAvatar, 
  updateUserCoverImage, 
  logoutUser,
  getWatchHistory
};
