import { v2 as cloudinary } from 'cloudinary';
import fs from 'fs';


cloudinary.config({ 
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME, 
    api_key: process.env.CLOUDINARY_API_KEY, 
    api_secret: process.env.CLOUDINARY_API_SECRET
});
    
const uploadOnCloudinary = async(localFilePath) =>{
    try {
        if(!localFilePath) return null
        const response = await cloudinary.uploader.upload(localFilePath, {
            localFilePath,
            resource_type : "auto"
        })
        
        console.log(`File uploaded on cloudinary and file src is ${response.url}`);
        //already uploaded on cloudinary so delete from local disk
        fs.unlinkSync(localFilePath)
        return response
    } catch (error) {
        fs.unlinkSync(localFilePath)
        console.log("catch block me pohoch gye hehehe")
        return null
    }
}

const deleteFromCloudinary = async(publicId)=>{
    try {
        const result = await cloudinary.uploader.destroy(publicId)
        console.log("Deleted from Cloudinary");
        
    } catch (error) {
        console.log("Error deleting from cloudinary", err);
        return null
    }
}

export { uploadOnCloudinary, deleteFromCloudinary }


