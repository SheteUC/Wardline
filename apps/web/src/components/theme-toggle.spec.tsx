import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useTheme } from "next-themes";
import { ThemeToggle } from "./theme-toggle";

describe("ThemeToggle", () => {
  const mockUseTheme = useTheme as jest.MockedFunction<typeof useTheme>;

  it("switches from light mode to dark mode", async () => {
    const setTheme = jest.fn();
    mockUseTheme.mockReturnValue({
      resolvedTheme: "light",
      setTheme,
      theme: "light",
      themes: ["light", "dark"],
      systemTheme: "light",
    } as ReturnType<typeof useTheme>);

    render(<ThemeToggle />);
    await userEvent.click(screen.getByRole("button", { name: "Toggle theme" }));

    expect(setTheme).toHaveBeenCalledWith("dark");
  });
});
