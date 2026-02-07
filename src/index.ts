// import type { Core } from '@strapi/strapi';

export default {
  /**
   * An asynchronous register function that runs before
   * your application is initialized.
   *
   * This gives you an opportunity to extend code.
   */
  register(/* { strapi }: { strapi: Core.Strapi } */) { },

  /**
   * An asynchronous bootstrap function that runs before
   * your application gets started.
   *
   * This gives you an opportunity to set up your data model,
   * run jobs, or perform some special logic.
   */
  bootstrap({ strapi }) {
    console.log('--- BOOTSTRAP: Patching Upload Service for Windows EPERM ---');
    try {
      const uploadPlugin = strapi.plugin('upload');
      if (uploadPlugin) {
        const uploadService = uploadPlugin.service('upload');
        const originalUpload = uploadService.upload;

        // Override upload method to catch EPERM errors
        uploadService.upload = async function (file) {
          try {
            return await originalUpload.call(this, file);
          } catch (err: any) {
            // Suppress Windows file locking errors
            if (err.code === 'EPERM' || err.code === 'EBUSY') {
              console.warn('⚠️ [Windows-Fix] Suppressed EPERM/EBUSY error during upload cleanup.');
              // Return file object to indicate "success" to proper controller flow
              return file;
            }
            throw err;
          }
        };
        console.log('--- BOOTSTRAP: Upload Service Patched Successfully ---');
      } else {
        console.warn('--- BOOTSTRAP: Upload plugin not found! ---');
      }

      // GLOBAL ERROR HANDLER for Windows EPERM (The Nuclear Option)
      // This catches errors thrown by libraries during async cleanup (outside request scope)
      process.on('uncaughtException', (err: any) => {
        if (err.code === 'EPERM' && err.syscall === 'unlink') {
          console.warn(`⚡ [Global-Fix] Suppressed uncaught EPERM error. Retrying deletion in 10s: ${err.path}`);

          if (err.path) {
            setTimeout(() => {
              const fs = require('fs');
              fs.unlink(err.path, (dateErr: any) => {
                if (dateErr) console.warn(`❌ Could not delete file after retry: ${err.path}`);
                else console.log(`✅ Successfully deleted locked file: ${err.path}`);
              });
            }, 10000);
          }
          return;
        }
        console.error('Uncaught Exception:', err);
        process.exit(1);
      });

      process.on('unhandledRejection', (reason: any, promise) => {
        if (reason?.code === 'EPERM' && reason?.syscall === 'unlink') {
          console.warn(`⚡ [Global-Fix] Suppressed unhandled rejection EPERM error. Retrying deletion in 10s: ${reason.path}`);

          if (reason.path) {
            setTimeout(() => {
              const fs = require('fs');
              fs.unlink(reason.path, (dateErr: any) => {
                if (dateErr) console.warn(`❌ Could not delete file after retry: ${reason.path}`);
                else console.log(`✅ Successfully deleted locked file: ${reason.path}`);
              });
            }, 10000);
          }
          return;
        }
        console.error('Unhandled Rejection:', reason);
      });

    } catch (error) {
      console.error('--- BOOTSTRAP: Error patching upload service ---', error);
    }
  },
};
