import fs from "fs";
import path from "path";
import { BaselineDataset } from "@/lib/types";
import { DashboardClient } from "@/components/DashboardClient";

export default function Home() {
  const baselinePath = path.join(process.cwd(), "data/baseline.json");
  const baselineData: BaselineDataset = JSON.parse(fs.readFileSync(baselinePath, "utf8"));

  return <DashboardClient initialCandidates={baselineData.candidates} />;
}
