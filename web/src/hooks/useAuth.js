import React from "react";

export const useAuth = () => {
  // Placeholder auth state; wire to real auth later.
  const [isAuthenticated] = React.useState(true);
  const [loading] = React.useState(false);
  return { isAuthenticated, loading };
};
