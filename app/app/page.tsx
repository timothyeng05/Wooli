import type { Metadata } from "next";
import CloudApp from "./CloudApp";
import "../demo/demo.css";
import "./cloud.css";

export const metadata: Metadata = {
  title: "Wooli Web App · iCloud Sign In",
  description: "Sign in with Apple to access the full Wooli app with your live iCloud Trips and Eats.",
};

export default function AppPage() {
  return <CloudApp />;
}
