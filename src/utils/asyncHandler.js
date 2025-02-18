const asyncHandler = (requestHandler) => {
    return (req, res, next) => {
        Promise
        .resolve(requestHandler(req, res, next)) //if input it already a promise it leaves it as it is, if input is not it ensures that the input is converted to promise. but then doesn't do so
        .catch((err) => next(err)) //we are not using reject because reject always creates a promise 
    }
}

export { asyncHandler }


