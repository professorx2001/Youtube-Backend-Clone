import mongoose, { isValidObjectId } from "mongoose"
import { Tweet } from "../models/tweet.model.js"
import { User } from "../models/user.model.js"
import { ApiError } from "../utils/apiError.js"
import { ApiResponse } from "../utils/apiResponse.js"
import { asyncHandler } from "../utils/asyncHandler.js"

const createTweet = asyncHandler(async (req, res) => {
    const user = await User.findById(req.user._id);
    if (!user) {
        throw new ApiError(404, "User not found.");
    }
    const { content } = req.body;
    if (!content) {
        throw new ApiError(400, "Content is required.");
    }
    let tweet;
    try {
        tweet = await Tweet.create({
            content,
            owner: req.user._id
        });
    } catch (error) {
        throw new ApiError(500, "Failed to create tweet.");
    }
    return res.status(201).json(new ApiResponse(201, tweet, "Tweet created successfully."));
})

const getUserTweets = asyncHandler(async (req, res) => {
    
    const tweets = await Tweet.find({ owner: req.user._id });
    console.log("above it");
    
    if(tweets.length === 0) {    
        console.log("below it");
        return res.status(404).json(new ApiResponse(404, null, "No tweets found."));
    }
    
    return res.status(200).json(new ApiResponse(200, tweets, "Tweets fetched successfully."));
})

const updateTweet = asyncHandler(async (req, res) => {
    const _id = req.params.tweetId;
    if (!isValidObjectId(_id)) {
        throw new ApiError(400, "Invalid tweet ID.");
    }
    const tweet = await Tweet.findById(_id);
    if (!tweet) {
        throw new ApiError(404, "Tweet not found.");
    }
    if (tweet.owner.toString() !== req.user._id.toString()) {
        throw new ApiError(403, "You are not authorized to update this tweet.");
    }
    const { content } = req.body;
    if (!content) {
        throw new ApiError(400, "Content is required.");
    }
    tweet.content = content;
    await tweet.save();
    return res.status(200).json(new ApiResponse(200, tweet, "Tweet updated successfully."));
})

const deleteTweet = asyncHandler(async (req, res) => {
    const _id = req.params.tweetId;
    if (!isValidObjectId(_id)) {
        throw new ApiError(400, "Invalid tweet ID.");
    }
    const tweet = await Tweet.findById(_id);
    if (!tweet) {
        throw new ApiError(404, "Tweet not found.");
    }
    if (tweet.owner.toString() !== req.user._id.toString()) {
        throw new ApiError(403, "You are not authorized to delete this tweet.");
    }
    await Tweet.deleteOne({_id});
    return res.status(200).json(new ApiResponse(200, null, "Tweet deleted successfully."));
})

export {
    createTweet,
    getUserTweets,
    updateTweet,
    deleteTweet
}
