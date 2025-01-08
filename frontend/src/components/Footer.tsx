import { useEffect, useState } from "react";
import MetaService from "services/MetaService";
import Clock from "./Clock";

const Footer = () => {
  const [version, setVersion] = useState<any>([]);

  useEffect(() => {
    MetaService.getVersion().then((data) => {
      setVersion(data);
    });
  }, []);
  
  return (
    <>
      <div className="footer">
        <ul>
          <li>VATSIM Airport Collaboration Decision Making v{version.version}</li>
        </ul>
        <ul>
          <li><Clock /></li>
        </ul>
      </div>
    </>
  );
};

export default Footer;
