import React from "react";

export const useAuth = () => {
  const [isAuthenticated, setIsAuthenticated] = React.useState(false);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    const authed = sessionStorage.getItem("dw-auth") === "1";
    setIsAuthenticated(authed);
    setLoading(false);
  }, []);

  return { isAuthenticated, loading, setIsAuthenticated };
};
