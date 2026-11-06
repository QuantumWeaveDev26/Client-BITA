import { redirect } from "next/navigation";

// The office layout sends anyone not logged in to /login.
export default function Home() {
  redirect("/enquiries");
}
