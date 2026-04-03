import { render, screen } from "@testing-library/react";
import Home from "./page";

describe("Home page", () => {
  it("renders the primary marketing headline", () => {
    render(<Home />);

    expect(
      screen.getByRole("heading", {
        name: /the ai voice receptionist your practice can actually run/i,
      }),
    ).toBeVisible();
    expect(screen.getAllByRole("link", { name: /start your free trial/i }).length).toBeGreaterThan(0);
  });
});
