import { redirect } from "next/navigation";

export default function RequestHelpPage() {
  redirect("/poster?section=help");
}
