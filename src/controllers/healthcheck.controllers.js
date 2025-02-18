import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiResponse } from "../utils/apiResponse.js";



const healthCheck = asyncHandler( async (req, res) => {
    return res
        .status(200)
        .json(new ApiResponse(200, "OK", "Health check Passed !!"))
})

export { healthCheck }