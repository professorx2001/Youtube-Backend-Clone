import { Router } from "express";
import { verifyJWT } from "../middlewares/auth.middlewares.js";
import { createTweet, getUserTweets, updateTweet, deleteTweet } from "../controllers/tweet.controllers.js";

const router = Router()

router.use(verifyJWT);

router
    .route("/")
    .post(createTweet)
    .get(getUserTweets)

router
    .route("/:tweetId")
    .put(updateTweet)
    .delete(deleteTweet)

export default router