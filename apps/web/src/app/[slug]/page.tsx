import { redirect } from "next/navigation";

export default async function ProjectRoot({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  redirect(`/${slug}/analytics`);
}
