import { render, screen } from "@testing-library/react";
import { usePathname } from "next/navigation";
import { SiteHeader } from "./site-header";

describe("SiteHeader", () => {
  const mockUsePathname = usePathname as jest.MockedFunction<typeof usePathname>;

  beforeEach(() => {
    mockUsePathname.mockReturnValue("/pricing");
  });

  it("renders primary navigation and the theme toggle", () => {
    render(<SiteHeader />);

    expect(screen.getAllByRole("link", { name: "Features" }).length).toBeGreaterThan(0);
    expect(
      screen
        .getAllByRole("link", { name: "Pricing" })
        .some((link) => link.classList.contains("text-primary")),
    ).toBe(true);
    expect(screen.getByRole("button", { name: "Toggle theme" })).toBeVisible();
    expect(screen.getAllByRole("link", { name: "Get started" }).length).toBeGreaterThan(0);
  });
});
