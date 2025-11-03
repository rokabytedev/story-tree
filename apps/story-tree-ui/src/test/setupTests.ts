import React from "react";
import { vi } from "vitest";

vi.mock("next/image", () => {
  const MockImage = ({
    alt,
    src,
    fill: _fill,
    sizes: _sizes,
    ...rest
  }: {
    alt?: string;
    src: string | { src: string };
  }) => {
    const resolvedSrc = typeof src === "string" ? src : src?.src ?? "";
    return React.createElement("img", {
      alt,
      src: resolvedSrc,
      ...rest,
    });
  };

  MockImage.displayName = "NextImageMock";

  return {
    __esModule: true,
    default: MockImage,
  };
});

vi.mock("next/link", () => {
  return {
    __esModule: true,
    default: ({ href, children, ...props }: any) =>
      React.createElement("a", { href, ...props }, children),
  };
});

vi.mock("@xyflow/react", () => {
  const Position = {
    Top: "top",
    Bottom: "bottom",
    Left: "left",
    Right: "right",
  };

  const Handle = ({ children, ...props }: any) =>
    React.createElement("div", props, children);

  return {
    __esModule: true,
    Handle,
    Position,
  };
});
