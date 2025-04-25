import React, { useState, useEffect, useRef } from "react";
import { useParams } from "react-router-dom";
import PilotService from "../services/PilotService";
import { Card } from "primereact/card";
import { DataTable } from "primereact/datatable";
import { Column } from "primereact/column";
import { InputNumber } from "primereact/inputnumber";
import { Button } from "primereact/button";
import { Toast } from "primereact/toast";
import Pilot, { PilotLog } from "@shared/interfaces/pilot.interface";
import timeUtils from "../utils/time";

const Debug = () => {
  const { callsign } = useParams();
  const [pilot, setPilot] = useState<Pilot>();
  const [logs, setLogs] = useState<PilotLog[]>();
  const [loading, setLoading] = useState(true);
  const [newCtot, setNewCtot] = useState<Date | null>(null);
  const [ctotHour, setCtotHour] = useState<number | null>(null);
  const [ctotMinute, setCtotMinute] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const toast = useRef<Toast>(null);

  // Format date to UTC string in a readable format
  const formatUTC = (date: Date | null | undefined): string => {
    if (!date) return "Not set";
    return new Date(date).toISOString().replace("T", " ").slice(0, 19) + " UTC";
  };

  useEffect(() => {
    async function loadData() {
      try {
        const data = await PilotService.getPilot(callsign);

        setPilot(data);
        if (!timeUtils.isTimeEmpty(new Date(data?.vacdm?.ctot))) {
          const ctotDate = new Date(data.vacdm.ctot);
          setNewCtot(ctotDate);
          setCtotHour(ctotDate.getUTCHours());
          setCtotMinute(ctotDate.getUTCMinutes());
        } else {
          // If no CTOT is set, default to current time + 30 minutes
          console.log("CTOT EMPTY:", data.vacdm.ctot);

          const defaultDate = new Date();
          defaultDate.setMinutes(defaultDate.getMinutes() + 30);
          setNewCtot(defaultDate);
          setCtotHour(defaultDate.getUTCHours());
          setCtotMinute(defaultDate.getUTCMinutes());
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

  // Update the newCtot date when hour or minute changes
  useEffect(() => {
    if (newCtot && ctotHour !== null && ctotMinute !== null) {
      const updatedDate = new Date(newCtot);
      updatedDate.setUTCHours(ctotHour);
      updatedDate.setUTCMinutes(ctotMinute);
      updatedDate.setUTCSeconds(0);
      setNewCtot(updatedDate);
    }
  }, [ctotHour, ctotMinute]);

  const updateCtot = async () => {
    if (!pilot || !newCtot) return;

    // Validate CTOT is in the future
    const now = new Date();
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
      // Update the pilot's CTOT
      await PilotService.updatePilot(pilot.callsign, {
        vacdm: {
          ...pilot.vacdm,
          ctot: newCtot,
        },
      });

      toast.current?.show({
        severity: "success",
        summary: "CTOT Updated",
        detail: `${pilot.callsign}'s CTOT has been updated to ${formatUTC(
          newCtot
        )}`,
        life: 3000,
      });

      // Refresh data
      const updatedPilot = await PilotService.getPilot(callsign);
      setPilot(updatedPilot);

      // Refresh logs
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

  const resetCdmTimes = async () => {
    if (!pilot) return;

    setSubmitting(true);
    try {
      // Reset all CDM times to new Date(-1)
      await PilotService.updatePilot(pilot.callsign, {
        inactive: false,
        disabledAt: new Date(-1),
        vacdm: {
          ...pilot.vacdm,
          ctot: new Date(-1),
          ttot: new Date(-1),
        },
      });

      toast.current?.show({
        severity: "success",
        summary: "Times Reset",
        detail: `${pilot.callsign}'s CDM times have been reset`,
        life: 3000,
      });

      // Refresh data
      const updatedPilot = await PilotService.getPilot(callsign);
      setPilot(updatedPilot);

      // Refresh logs
      const updatedLogs = await PilotService.getPilotLogs(callsign);
      setLogs(updatedLogs);
    } catch (error) {
      toast.current?.show({
        severity: "error",
        summary: "Reset Failed",
        detail: "Failed to reset CDM times",
        life: 3000,
      });
      console.error("Failed to reset CDM times:", error);
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
                        {formatUTC(pilot.vacdm.ctot)}
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

                <h5>ATC Controls</h5>
                <div className="flex flex-column gap-3">
                  <div>
                    <div className="flex align-items-center">
                      <span className="font-bold">Set CTOT Time (UTC):</span>{" "}
                      {newCtot ? formatUTC(newCtot) : "Not set"}
                    </div>
                  </div>

                  {/* Fix for the input fields layout */}
                  <div className="grid">
                    <div className="col-12 md:col-6 lg:col-5 xl:col-4">
                      <div className="p-fluid">
                        <label htmlFor="hour-input" className="mb-1">
                          Hour (UTC)
                        </label>
                        <InputNumber
                          id="hour-input"
                          value={ctotHour}
                          onValueChange={(e) => setCtotHour(e.value ?? null)}
                          min={0}
                          max={23}
                          showButtons
                          buttonLayout="horizontal"
                          decrementButtonClassName="p-button-secondary"
                          incrementButtonClassName="p-button-secondary"
                          incrementButtonIcon="pi pi-plus"
                          decrementButtonIcon="pi pi-minus"
                        />
                      </div>
                    </div>

                    <div className="col-12 md:col-6 lg:col-5 xl:col-4">
                      <div className="p-fluid">
                        <label htmlFor="minute-input" className="mb-1">
                          Minute
                        </label>
                        <InputNumber
                          id="minute-input"
                          value={ctotMinute}
                          onValueChange={(e) => setCtotMinute(e.value ?? null)}
                          min={0}
                          max={59}
                          showButtons
                          buttonLayout="horizontal"
                          decrementButtonClassName="p-button-secondary"
                          incrementButtonClassName="p-button-secondary"
                          incrementButtonIcon="pi pi-plus"
                          decrementButtonIcon="pi pi-minus"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-row gap-3">
                    <Button
                      label="Update CTOT"
                      icon="pi pi-clock"
                      onClick={updateCtot}
                      loading={submitting}
                    />

                    <Button
                      label="Reset CDM Times"
                      icon="pi pi-trash"
                      className="p-button-danger"
                      onClick={resetCdmTimes}
                      loading={submitting}
                      tooltip="Resets CTOT, TTOT, TSAT, ASRT, ASAT and AOBT"
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
