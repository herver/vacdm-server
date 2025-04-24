import React, { useState, useEffect, useRef } from "react";
import { useParams } from "react-router-dom";
import PilotService from "../services/PilotService";
import { Card } from "primereact/card";
import { DataTable } from "primereact/datatable";
import { Column } from "primereact/column";
import { Calendar } from "primereact/calendar";
import { Button } from "primereact/button";
import { Toast } from "primereact/toast";
import Pilot, { PilotLog } from "@shared/interfaces/pilot.interface";

const Debug = () => {
  const { callsign } = useParams();
  const [pilot, setPilot] = useState<Pilot>();
  const [logs, setLogs] = useState<PilotLog[]>();
  const [loading, setLoading] = useState(true);
  const [newCtot, setNewCtot] = useState<Date | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const toast = useRef<Toast>(null);

  useEffect(() => {
    async function loadData() {
      try {
        const data = await PilotService.getPilot(callsign);

        setPilot(data);
        if (data?.vacdm?.ctot) {
          setNewCtot(new Date());
        }
        setLoading(false);
        const logs = await PilotService.getPilotLogs(callsign);
        setLogs(logs);
      } catch (e) {}
    }
    let intervalId = setInterval(loadData, 30000);

    loadData();

    return () => clearInterval(intervalId);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const logDataTemplate = (rowData: any) => {
    return <pre>{JSON.stringify(rowData.data, null, 2)}</pre>;
  };

  const updateCtot = async () => {
    if (!pilot || !newCtot) return;

    const now = new Date();
    console.log("now", now);
    console.log("oldCtot", pilot.vacdm.ctot);
    console.log("newCtot", newCtot);
    if (newCtot <= now) {
      toast.current?.show({
        severity: "error",
        summary: "Invalid CTOT",
        detail: "CTOT must be in the future",
        life: 3000,
      });
      return;
    }

    setSubmitting(true);
    try {
      await PilotService.updatePilot(pilot.callsign, {
        vacdm: {
          ...pilot.vacdm,
          ctot: newCtot,
        },
      });

      toast.current?.show({
        severity: "success",
        summary: "CTOT Updated",
        detail: `${pilot.callsign}'s CTOT has been updated successfully`,
        life: 3000,
      });

      const updatedPilot = await PilotService.getPilot(callsign);
      setPilot(updatedPilot);

      const updatedLogs = await PilotService.getPilotLogs(callsign);
      setLogs(updatedLogs);
    } catch (error) {
      toast.current?.show({
        severity: "error",
        summary: "Update Failed",
        detail: "Failed to update CTOT",
        life: 3000,
      });
      console.error("Failed to update CTOT:", error);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading || !pilot) {
    return <div>Loading</div>;
  }

  return (
    <>
      <Toast ref={toast} />
      <div className="grid">
        <div className="col">
          <Card>
            <div className="grid">
              <div className="col">
                <h5>Flight Data</h5>
                <div className="flex flex-row flex-wrap gap-3">
                  <div className="flex align-items-center justify-content-center  ">
                    <div className="inline-block">
                      <div className="text-sm text-center">Callsign</div>
                      <div className="text-2xl text-center">
                        {pilot.callsign}
                      </div>
                    </div>
                  </div>
                  <div className="flex align-items-center justify-content-center  ">
                    <div className="inline-block">
                      <div className="text-sm text-center">ADEP</div>
                      <div className="text-2xl text-center">
                        {pilot.flightplan.departure}
                      </div>
                    </div>
                  </div>
                  <div className="flex align-items-center justify-content-center  ">
                    <div className="inline-block">
                      <div className="text-sm text-center">ADES</div>
                      <div className="text-2xl text-center">
                        {pilot.flightplan.arrival}
                      </div>
                    </div>
                  </div>
                  <div className="flex align-items-center justify-content-center">
                    <div className="inline-block">
                      <div className="text-sm text-center">Runway</div>
                      <div className="text-2xl text-center">
                        {pilot.clearance.dep_rwy}
                      </div>
                    </div>
                  </div>
                  <div className="flex align-items-center justify-content-center ">
                    <div className="inline-block">
                      <div className="text-sm text-center">SID</div>
                      <div className="text-2xl text-center">
                        {pilot.clearance.sid}
                      </div>
                    </div>
                  </div>
                  <div className="flex align-items-center justify-content-center ">
                    <div className="inline-block">
                      <div className="text-sm text-center">Initial Climb</div>
                      <div className="text-2xl text-center">
                        {pilot.clearance.initial_climb}
                      </div>
                    </div>
                  </div>
                  <div className="flex align-items-center justify-content-center ">
                    <div className="inline-block">
                      <div className="text-sm text-center">Flightrule</div>
                      <div className="text-2xl text-center">
                        {pilot.flightplan.flight_rules}
                      </div>
                    </div>
                  </div>
                </div>
                <h5>CDM Data</h5>
                <div className="flex flex-row flex-wrap gap-3">
                  <div className="flex align-items-center justify-content-center  ">
                    <div className="inline-block">
                      <div className="text-sm text-center">EOBT</div>
                      <div className="text-2xl text-center">
                        {new Date(pilot.vacdm.eobt).toISOString()}
                      </div>
                    </div>
                  </div>
                  <div className="flex align-items-center justify-content-center  ">
                    <div className="inline-block">
                      <div className="text-sm text-center">TOBT</div>
                      <div className="text-2xl text-center">
                        {new Date(pilot.vacdm.tobt).toISOString()}
                      </div>
                    </div>
                  </div>
                  <div className="flex align-items-center justify-content-center  ">
                    <div className="inline-block">
                      <div className="text-sm text-center">TSAT</div>
                      <div className="text-2xl text-center">
                        {new Date(pilot.vacdm.tsat).toISOString()}
                      </div>
                    </div>
                  </div>

                  <div className="flex align-items-center justify-content-center ">
                    <div className="inline-block">
                      <div className="text-sm text-center">TTOT</div>
                      <div className="text-2xl text-center">
                        {new Date(pilot.vacdm.ttot).toISOString()}
                      </div>
                    </div>
                  </div>

                  <div className="flex align-items-center justify-content-center ">
                    <div className="inline-block">
                      <div className="text-sm text-center">CTOT</div>
                      <div className="text-2xl text-center">
                        {pilot.vacdm.ctot
                          ? new Date(pilot.vacdm.ctot).toISOString()
                          : "Not set"}
                      </div>
                    </div>
                  </div>

                  <div className="flex align-items-center justify-content-center ">
                    <div className="inline-block">
                      <div className="text-sm text-center">ASAT</div>
                      <div className="text-2xl text-center">
                        {new Date(pilot.vacdm.asat).toISOString()}
                      </div>
                    </div>
                  </div>
                  <div className="flex align-items-center justify-content-center ">
                    <div className="inline-block">
                      <div className="text-sm text-center">AOBT</div>
                      <div className="text-2xl text-center">
                        {new Date(pilot.vacdm.aobt).toISOString()}
                      </div>
                    </div>
                  </div>
                  <div className="flex align-items-center justify-content-center ">
                    <div className="inline-block">
                      <div className="text-sm text-center">Prio</div>
                      <div className="text-2xl text-center">
                        {pilot.vacdm.prio}
                      </div>
                    </div>
                  </div>
                  <div className="flex align-items-center justify-content-center">
                    <div className="inline-block">
                      <div className="text-sm text-center">EXOT</div>
                      <div className="text-2xl text-center">
                        {pilot.vacdm.exot}
                      </div>
                    </div>
                  </div>
                </div>

                  <div className="mt-4">
                    <h5>ATC Controls</h5>
                    <div className="flex flex-row gap-3 align-items-center">
                      <div className="inline-block">
                        <div className="text-sm">Update CTOT</div>
                        <Calendar
                          id="ctot-picker"
                          value={newCtot}
                          onChange={(e) => setNewCtot(e.value as Date)}
                          showTime
                          hourFormat="24"
                          showSeconds
                          dateFormat="yy-mm-dd"
                        />
                      </div>
                      <Button
                        label="Save CTOT"
                        icon="pi pi-save"
                        onClick={updateCtot}
                        loading={submitting}
                        className="mt-4"
                      />
                    </div>
                  </div>

                <h5>Database Data</h5>
                <div className="flex flex-row flex-wrap gap-3">
                  <div className="flex align-items-center justify-content-center  ">
                    <div className="inline-block">
                      <div className="text-sm text-center">Created At</div>
                      <div className="text-2xl text-center">
                        {new Date(pilot.createdAt).toISOString()}
                      </div>
                    </div>
                  </div>
                  <div className="flex align-items-center justify-content-center  ">
                    <div className="inline-block">
                      <div className="text-sm text-center">Updated At</div>
                      <div className="text-2xl text-center">
                        {new Date(pilot.updatedAt).toISOString()}
                      </div>
                    </div>
                  </div>
                  <div className="flex align-items-center justify-content-center  ">
                    <div className="inline-block">
                      <div className="text-sm text-center">Inactive</div>
                      <div className="text-2xl text-center">
                        {pilot.inactive ? "true" : "false"}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </Card>
        </div>
        <div className="col">
          <DataTable value={logs}>
            <Column field="time" header="Time" />
            <Column field="namespace" header="Namespace" />
            <Column field="action" header="Action" />
            <Column field="data" header="Data" body={logDataTemplate} />
          </DataTable>
        </div>
      </div>
    </>
  );
};

export default Debug;
