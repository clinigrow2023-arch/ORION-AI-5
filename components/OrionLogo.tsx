import React from "react";
import { ORION_LOGO_SRC } from "../lib/brand";

type OrionLogoProps = {
  size?: number;
  className?: string;
  alt?: string;
};

const OrionLogo: React.FC<OrionLogoProps> = ({
  size = 32,
  className = "",
  alt = "Orion AI",
}) => (
  <img
    src={ORION_LOGO_SRC}
    alt={alt}
    width={size}
    height={size}
    className={`object-contain shrink-0 ${className}`}
    draggable={false}
  />
);

export default OrionLogo;
