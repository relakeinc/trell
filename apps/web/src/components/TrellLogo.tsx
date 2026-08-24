import Image from "next/image";

export function TrellLogo({ className }: { className?: string }) {
  return (
    <Image
      src="/icon.svg"
      alt="Trell"
      width={124}
      height={46}
      className={className}
      priority
    />
  );
}
