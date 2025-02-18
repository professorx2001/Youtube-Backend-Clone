import jwt from "jsonwebtoken";
import { User } from "../models/user.model.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/apiError.js";


export const verifyJWT = asyncHandler(async (req, _, next) => {
    //If req coming even from mobile devices we need to get token from header
    const token = req.header("Authorization")?.replace("Bearer ", "");

    if (!token) {
        throw new ApiError(401, "Authorization token not found.")
    }
    try {
        const decodedToken = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
        const user = await User.findById(decodedToken?._id).select("-password -refreshToken -watchHistory");
        if (!user) {
            throw new ApiError(401, "User not found.")
        }
        req.user = user;
    } catch (error) {
        throw new ApiError(401, error.message || "Invalid access token.")
    }
    next()
})