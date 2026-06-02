import type { CSSProperties } from "react";
import Image from "next/image";

const ICON_VERSION = "2026-05-31-design";

type Props = {
    name: string;
    alt: string;
    tone?: string;
    size?: number;
};

export default function DesignIcon({ name, alt, tone = "", size = 64 }: Props) {
    const style = { "--design-icon-size": `${size}px` } as CSSProperties;

    return (
        <span className={`design-icon-badge ${tone}`.trim()} style={style}>
            <Image
                className="design-icon-image"
                src={`/design-icons/${name}.png?v=${ICON_VERSION}`}
                alt={alt}
                width={size}
                height={size}
                unoptimized
            />
        </span>
    );
}
