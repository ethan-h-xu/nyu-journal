import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { CampusMap } from "./map/CampusMap";
import "./styles.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <CampusMap />
  </StrictMode>,
);
