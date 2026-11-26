import fs from "node:fs/promises";
import path from "node:path";
import { SetConfig } from "../../lib/schemas";

export function sanitizeSetFilename(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "custom-set"
  );
}

export async function writeGeneratedSetComponent(set: SetConfig): Promise<string> {
  const slug = sanitizeSetFilename(set.name);
  const componentName = slug
    .split("-")
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join("");
  const fileName = `Set_${componentName || "Custom"}.tsx`;
  const targetDir = path.join(process.cwd(), "src", "remotion", "scenes");
  await fs.mkdir(targetDir, { recursive: true });
  const targetPath = path.join(targetDir, fileName);

  const code = `import React from "react";
import { VoxelSetScene } from "./VoxelSetScene";
import type { SetConfig } from "../../lib/schemas";

export const ${componentName || "Custom"}SetConfig: SetConfig = ${JSON.stringify(set, null, 2)};

export const ${componentName || "Custom"}Scene: React.FC = () => {
  return <VoxelSetScene set={${componentName || "Custom"}SetConfig} />;
};
`;

  await fs.writeFile(targetPath, code, "utf8");
  return `src/remotion/scenes/${fileName}`;
}
