import React from "react";
import { createRoot } from "react-dom/client";
import ClubApp from "../components/club/app";
import "../app/globals.css";
createRoot(document.getElementById("root")!).render(<ClubApp />);
