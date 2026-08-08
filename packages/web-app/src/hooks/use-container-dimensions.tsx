"use client";

import { useEffect, useState } from "react";

export const useContainerDimensions = (myRef: React.RefObject<HTMLElement | null>) => {
  const [dimensions, setDimensions] = useState({ height: 0, width: 0 });

  useEffect(() => {
    const getDimensions = () => ({
      height: myRef.current?.offsetHeight ?? 0,
      width: myRef.current?.offsetWidth ?? 0,
    });

    const handleResize = () => {
      setDimensions(getDimensions());
    };

    if (myRef.current) {
      setDimensions(getDimensions());
    }

    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, [myRef]);

  return dimensions;
};
