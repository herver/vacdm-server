import dayjs from "dayjs";
import { useEffect, useState } from "react";
import MetaService from "services/MetaService";

const Footer = () => {
  const [version, setVersion] = useState<any>([]);
  const [clock, setClock] = useState(dayjs(new Date()).utc().format('HH:mm:ss'));

  useEffect(() => {
    MetaService.getVersion().then((data) => {
      setVersion(data);
    });

    let clockInterval = setInterval(utcTime, 1000)
    return () => {
      clearInterval(clockInterval);
    }
  }, []);
  
  function utcTime() {
    return setClock(dayjs(new Date()).utc().format('HH:mm:ss'));
  }
  
  return (
    <>
      <div className="footer">
        <ul>
          <li>VATSIM Airport Collaboration Decision Making v{version.version}</li>
        </ul>
        <ul>
          <li>{clock} UTC</li>
        </ul>
      </div>
    </>
  );
};

export default Footer;
