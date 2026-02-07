console.log('--- UPLOAD EXTENSION LOADED ---');

export default (plugin) => {
    const uploadService = plugin.services.upload;
    const originalUpload = uploadService.upload;

    uploadService.upload = async (file) => {
        try {
            console.log('--- Uploading file:', file?.name);
            const result = await originalUpload.call(uploadService, file);
            console.log('--- Upload Success:', result?.url);
            return result;
        } catch (err: any) {
            console.error('--- Upload Error Caught:', err);

            // Check for EPERM/EBUSY on Windows
            if (err.code === 'EPERM' || err.code === 'EBUSY') {
                console.warn('⚠️ [Fix-Windows-EPERM] Suppressed error:', err.message);

                // Return file even if url is missing, to keep server alive.
                // If upload failed, file.url might be missing, causing frontend error, but backend lives.
                return file;
            }

            throw err;
        }
    };

    return plugin;
};
