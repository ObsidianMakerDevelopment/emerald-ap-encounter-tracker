import { defineConfig } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";

export default defineConfig({
    root: "tracker",              // your HTML lives here
    build: {
        outDir: "../dist",          // output folder relative to root
        rollupOptions: {
            input: "tracker.html",    // entry HTML file
            output: {
                entryFileNames: "tracker.js",
                assetFileNames: "tracker.[ext]",
            }
        },
        minify: false,                // disable JS/CSS/HTML minification
        cssMinify: false,             // disable CSS minification (Vite 5+)
        target: "esnext",
        assetsInlineLimit: 100000000
    },
    plugins: [viteSingleFile()]
});
