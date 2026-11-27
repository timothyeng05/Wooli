import type { Metadata } from "next";
import CloudApp from "./CloudApp";
import "./web-shell.css";
import "./cloud.css";

export const metadata: Metadata = {
  title: "Wooli · Web App",
  description: "Sign in with Apple to access your live iCloud Trips, Eats, Sights, Movies, Recipes, and Budget.",
};

export default function AppPage() {
  return <CloudApp />;
}
