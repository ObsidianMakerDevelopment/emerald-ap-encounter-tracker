import { defineConfig } from "vite";
import esbuild from "rollup-plugin-esbuild";
import { viteSingleFile } from "vite-plugin-singlefile";
import fs from "fs";
import path from "path";

function renameHtmlPlugin(finalName = "emerald-encounter-tracker.html") {
    let resolvedConfig = null;
    return {
        name: "rename-html-plugin",
        configResolved(config) {
            resolvedConfig = config;
        },
        closeBundle() {
            try {
                if (!resolvedConfig) return;
                const root = resolvedConfig.root || process.cwd();
                const outDir = resolvedConfig.build && resolvedConfig.build.outDir ? resolvedConfig.build.outDir : "dist";
                const fullOut = path.isAbsolute(outDir) ? outDir : path.resolve(root, outDir);
                const files = fs.readdirSync(fullOut);
                // find the first HTML file and rename it
                const htmlFile = files.find(f => f.toLowerCase().endsWith('.html'));
                if (!htmlFile) return;
                const src = path.join(fullOut, htmlFile);
                const dest = path.join(fullOut, finalName);
                if (fs.existsSync(dest)) fs.unlinkSync(dest);
                fs.renameSync(src, dest);
                console.log(`[rename-html-plugin] Renamed ${htmlFile} -> ${finalName}`);
            } catch (e) {
                console.error('[rename-html-plugin] error while renaming HTML:', e);
            }
        }
    };
}

export default defineConfig({
    root: "tracker",              // your HTML lives here
    build: {
        outDir: "../dist",          // output folder relative to root
        emptyOutDir: true,           // ensure dist is emptied before build
        rollupOptions: {
            input: "tracker.html",    // entry HTML file
            output: {
                entryFileNames: "tracker.js",
                assetFileNames: "tracker.[ext]",
            }
        },
        minify: true,                // disable JS/CSS/HTML minification
        cssMinify: true,             // disable CSS minification (Vite 5+)
        target: "esnext",
        assetsInlineLimit: 100000000
    },
    plugins: [viteSingleFile(), renameHtmlPlugin("emerald-encounter-tracker.html"),
    esbuild({
        minify: true,
        minifyWhitespace: true,
        minifyIdentifiers: false, // DO NOT rename variables
        minifySyntax: false        // DO NOT rewrite expressions
    })
    ]
});
