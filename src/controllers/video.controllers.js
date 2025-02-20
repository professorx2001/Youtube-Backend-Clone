import mongoose, {isValidObjectId} from "mongoose"
import { Video } from "../models/video.model.js"
import { User } from "../models/user.model.js"
import { ApiError } from "../utils/apiError.js"
import { ApiResponse } from "../utils/apiResponse.js"
import { asyncHandler } from "../utils/asyncHandler.js"
import { deleteFromCloudinary, uploadOnCloudinary } from "../utils/cloudinary.js"


const getAllVideos = asyncHandler(async (req, res) => {
    const { page = 1, limit = 10, query, sortBy, sortType, userId } = req.query
    //TODO: get all videos based on query, sort, pagination
})

const publishAVideo = asyncHandler(async (req, res) => {
    const { title, description } = req.body;

    if (!title || !description) {
        throw new ApiError(400, "Title and description are required");
    }

    const localVideoPath = req.files?.video?.[0]?.path;
    const localThumbnailPath = req.files?.thumbnail?.[0]?.path;

    if (!localVideoPath || !localThumbnailPath) {
        throw new ApiError(400, "Video and thumbnail files are required.");
    }

    let videoUrl, thumbnailUrl;
    try {
        videoUrl = await uploadOnCloudinary(localVideoPath);
        thumbnailUrl = await uploadOnCloudinary(localThumbnailPath);
    } catch (error) {
        // Clean up if one upload succeeded before failure
        if (videoUrl) await deleteFromCloudinary(videoUrl.secure_url);
        if(thumbnailUrl) await deleteFromCloudinary(thumbnailUrl.secure_url);
        throw new ApiError(500, error.message || "Failed to upload video or thumbnail.");
    }


    const duration = videoUrl?.duration ?? 0;


    try {
        const video = await Video.create({
            videoFile: videoUrl.secure_url,
            thumbnail: thumbnailUrl.secure_url,
            title,
            description,
            duration,
            views: 0,
            isPublished: true,
            owner: req.user._id,
        });
    } catch (error) {
        if(videoUrl) await deleteFromCloudinary(videoUrl.secure_url);
        if(thumbnailUrl) await deleteFromCloudinary(thumbnailUrl.secure_url);
        throw new ApiError(500, "Failed to create video.");
    }

    return res.status(201).json(new ApiResponse(201, video, "Video uploaded successfully."));
});


const getVideoById = asyncHandler(async (req, res) => {
    const { videoId } = req.params;

    if (!isValidObjectId(videoId)) {
        throw new ApiError(400, "Invalid video ID.");
    }

    try {
        const video = await Video.findById(videoId);

        if (!video) {
            throw new ApiError(404, "Video not found.");
        }

        return res.status(200).json(new ApiResponse(200, video, "Video fetched successfully."));
    } catch (error) {
        console.error("Error fetching video:", error);
        throw new ApiError(500, "Something went wrong while fetching the video.");
    }
});


const updateVideo = asyncHandler(async (req, res) => {
    const { videoId } = req.params;
    const { title, description } = req.body;

    if (!req.user) {
        throw new ApiError(401, "Unauthorized request. Please log in.");
    }
    const _id = req.user._id;

    // if (!isValidObjectId(videoId)) {
    //     throw new ApiError(400, "Invalid video ID.");
    // }
    if(!title || !description){
        throw new ApiError(400, "Title and description are required.");
    }
    if ([title, description].some((field) => field === undefined && field?.trim() === "")) {
        throw new ApiError(400, "All fields are required.");
    }
    

    const video = await Video.findById(videoId);
    if (!video) {
        throw new ApiError(404, "Video not found.");
    }

    if (video.owner.toString() !== _id.toString()) {
        throw new ApiError(403, "You are not authorized to update this video.");
    }

    let thumbnail = video.thumbnail; // Keeping old thumbnail if none is uploaded

    const localThumbnailPath = req.files?.thumbnail?.[0]?.path;
    if (localThumbnailPath) {
        try {
            await deleteFromCloudinary(video.thumbnail);
            const uploaded = await uploadOnCloudinary(localThumbnailPath);
            thumbnail = uploaded.secure_url;
        } catch (error) {
            throw new ApiError(500, "Failed to upload thumbnail.");
        }
    }

    if (title) video.title = title;
    if (description) video.description = description;
    video.thumbnail = thumbnail;

    try {
        await video.save({ validateBeforeSave: false });
    } catch (error) {
        throw new ApiError(500, "Failed to save video updates.");
    }

    return res.status(200).json(new ApiResponse(200, video, "Video updated successfully."));
});


const deleteVideo = asyncHandler(async (req, res) => {
    const { videoId } = req.params

    if (!isValidObjectId(videoId)) {
        throw new ApiError(400, "Invalid video ID.");
    }

    if (!req.user) {
        throw new ApiError(401, "Unauthorized request. Please log in.");
    }
    const _id = req.user._id;   

    const video = await Video.findById(videoId);
    if (!video) {
        throw new ApiError(404, "Video not found.");
    }

    if (video.owner.toString() !== _id.toString()) {
        throw new ApiError(403, "You are not authorized to delete this video.");
    }

    try {
        await deleteFromCloudinary(video.videoFile);
        await deleteFromCloudinary(video.thumbnail);
        await video.remove();
    } catch (error) {
        throw new ApiError(500, "Failed to delete video.");
    }

    return res.status(200).json(new ApiResponse(200, null, "Video deleted successfully."));
    
})

const togglePublishStatus = asyncHandler(async (req, res) => {
    const { videoId } = req.params
})

export {
    getAllVideos,
    publishAVideo,
    getVideoById,
    updateVideo,
    deleteVideo,
    togglePublishStatus
}