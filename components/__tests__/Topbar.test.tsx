import { render, screen } from "@testing-library/react";
import Topbar from "../Topbar";

describe("Topbar", () => {
  it("renders the Dr Codium brand", () => {
    render(<Topbar />);
    expect(screen.getByText("Dr Codium")).toBeInTheDocument();
  });

  it("renders all three role buttons", () => {
    render(<Topbar />);
    expect(screen.getByText("Developer")).toBeInTheDocument();
    expect(screen.getByText("Manager")).toBeInTheDocument();
    expect(screen.getByText("Director / VP")).toBeInTheDocument();
  });

  it("renders the bell icon button", () => {
    render(<Topbar />);
    const bellButton = screen.getByRole("button", { name: /🔔/ });
    expect(bellButton).toBeInTheDocument();
  });

  it("renders the avatar", () => {
    render(<Topbar />);
    expect(screen.getByText("PR")).toBeInTheDocument();
  });
});
