import React from "react";
import type {
  AnchorHTMLAttributes,
  HTMLAttributes,
  ImgHTMLAttributes,
  PropsWithChildren,
} from "react";
import { vi } from "vitest";

Object.defineProperty(window.HTMLMediaElement.prototype, "load", {
  configurable: true,
  value() {
    // jsdom does not implement load(); provide a no-op for audio elements in tests.
  },
});

vi.mock("next/image", () => {
  type MockImageProps = Omit<ImgHTMLAttributes<HTMLImageElement>, "src" | "alt"> & {
    alt?: string;
    src: string | { src: string };
    fill?: boolean;
  };

  const MockImage = ({ alt, src, fill, sizes, ...imgProps }: MockImageProps) => {
    void fill;
    void sizes;
    const resolvedSrc = typeof src === "string" ? src : src?.src ?? "";
    return React.createElement("img", {
      alt,
      src: resolvedSrc,
      ...imgProps,
    });
  };

  MockImage.displayName = "NextImageMock";

  return {
    __esModule: true,
    default: MockImage,
  };
});

vi.mock("next/link", () => {
  type MockLinkProps = PropsWithChildren<AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }>;

  return {
    __esModule: true,
    default: ({ href, children, ...props }: MockLinkProps) =>
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

  const Handle = ({ children, ...props }: PropsWithChildren<HTMLAttributes<HTMLDivElement>>) =>
    React.createElement("div", props, children);

  return {
    __esModule: true,
    Handle,
    Position,
  };
});
