import {
  createContext,
  useState,
  Dispatch,
  SetStateAction,
  useEffect,
} from "react";
import authService from "services/AuthService";
import DatafeedService from "services/DatafeedService";

import { useNavigate } from "react-router-dom";

const AuthContext = createContext<{
  auth: Object;
  setAuth: Dispatch<SetStateAction<{}>>;
}>({ auth: {}, setAuth: () => {} });

export const AuthProvider = ({ children }: { children: any }) => {
  const [auth, setAuth] = useState({});

  const navigate = useNavigate();

  useEffect(() => {
    authService
      .getProfile()
      .then(async (data) => {
        setAuth({ user: data });

        // Redirect ATCs to /atc, unless they're also flying as a pilot
        if (data.vacdm?.atc && !data.vacdm?.banned) {
          try {
            // Check if user is currently flying
            await DatafeedService.getPilotFromCid(data.apidata.cid);
            // User is flying - stay on VDGS (no redirect)
          } catch (e) {
            // User is not flying - redirect to ATC view
            navigate("/atc");
          }
        }
      })
      .catch((e) => {
        setAuth({});
        navigate("/login");
      });
  }, []);

  return (
    <>
      <AuthContext.Provider value={{ auth, setAuth }}>
        {children}
      </AuthContext.Provider>
    </>
  );
};
export default AuthContext;
