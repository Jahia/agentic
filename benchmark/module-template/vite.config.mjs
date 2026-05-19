import { defineConfig } from "vite";
import jahia from "@jahia/vite-plugin";
import { spawnSync } from "node:child_process";

export default defineConfig({
  plugins: [
    jahia({
      watchCallback() {
        spawnSync("yarn", ["watch:callback"], { stdio: "inherit", shell: true });
      },
    }),
  ],
});
