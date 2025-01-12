import dayjs from "dayjs";
import { useEffect, useState } from "react";

const Clock = () => {
  const [clock, setClock] = useState(dayjs(new Date()).utc().format('HH:mm:ss'));

  useEffect(() => {
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
   {clock} UTC
    </>
  );
};

export default Clock;
