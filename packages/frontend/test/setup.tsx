import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

afterEach(() => {
  cleanup();
});

// Mock framer-motion to avoid animation issues in tests
vi.mock("framer-motion", async () => {
  const actual = await vi.importActual("framer-motion");
  return {
    ...actual,
    AnimatePresence: ({ children }: { children: React.ReactNode }) => children,
    motion: new Proxy(
      {},
      {
        get: (_target, prop: string) => {
          const Component = ({
            children,
            animate,
            initial,
            exit,
            transition,
            whileHover,
            whileTap,
            ...props
          }: any) => {
            const Tag = prop as keyof JSX.IntrinsicElements;
            return <Tag {...props}>{children}</Tag>;
          };
          Component.displayName = `motion.${prop}`;
          return Component;
        },
      }
    ),
  };
});

// Mock next/link
vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: any) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

// Mock next/image
vi.mock("next/image", () => ({
  default: (props: any) => <img {...props} />,
}));
