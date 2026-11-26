import type { Metadata } from "next";
import CloudApp from "./CloudApp";
import "./cloud.css";

export const metadata: Metadata = {
  title: "Wooli Web App · iCloud Sync",
  description: "Sign in with Apple to access your private and shared Wooli Trips and Eats from any browser or Windows PC.",
};

export default function AppPage() {
  return <CloudApp />;
}
