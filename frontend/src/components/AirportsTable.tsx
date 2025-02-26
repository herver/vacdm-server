import { useState, useEffect, useContext } from "react";
import { DataTable } from "primereact/datatable";
import { Column } from "primereact/column";
import { Card } from "primereact/card";
import AirportService from "../services/AirportService";
import { InputTextarea } from "primereact/inputtextarea";
import { Badge } from 'primereact/badge';
import { Link } from "react-router-dom";
import { Button } from "primereact/button";
import AuthContext from 'contexts/AuthProvider'; // Import AuthContext

const AirpotsTable = () => {
  const [airports, setAirports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedRows, setExpandedRows] = useState<any>(null);
  const auth: any = useContext(AuthContext); // Use the same AuthContext as Navbar

  // Check if user is admin
  const isAdmin = auth.auth.user && auth.auth.user.vacdm && auth.auth.user.vacdm.admin;

  useEffect(() => {
    AirportService.getAirports().then((data: any[]) => {
      setAirports(data);
      setLoading(false);
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const taxioutTemplate = (rowData: any) => {
    return (rowData.taxiout ? <Badge value="true" severity="success" /> : <Badge value="false" severity="danger" />)
  }

  const editButtonTemplate = (rowData: any) => {
    return (
      <Link to={`/airports/${rowData.icao}`}>
        <Button className="p-button-sm " label="Edit" />{" "}
      </Link>
    );
  };

  const blocksButtonTemplate = (rowData: any) => {
    return (
      <Link to={`/departure-blocks/${rowData.icao}`}>
        <Button className="p-button-sm " label="Blocks" />{" "}
      </Link>
    );
  };

  const handleDeleteAllPilots = async (icao: string) => {
    if (window.confirm(`Are you sure you want to flush ALL pilots data for ${icao}? This action cannot be undone!`)) {
      try {
        const response = await fetch(`/api/v1/airports/${icao}/pilots`, {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json'
          }
        });
        
        if (!response.ok) {
          throw new Error('Failed to flush pilots');
        }
        
        // Show success message
        alert(`Successfully flushed all pilots for ${icao}`);
      } catch (error) {
        console.error('Error flushing pilots:', error);
        alert('Failed to flush pilots');
      }
    }
  };

  const deleteAllPilotsTemplate = (rowData: any) => {
    return (
      <Button 
        onClick={() => handleDeleteAllPilots(rowData.icao)} 
        className="p-button-sm p-button-danger"
        label="Flush All Pilots"
        icon="pi pi-trash"
        tooltip={`Flush all pilots and logs for ${rowData.icao}`}
        tooltipOptions={{ position: 'top' }}
      />
    );
  };

  const rowExpansionTemplate = (data: any) => {
    return (
      <>
        <div className="grid">
          <div className="col">
            <DataTable value={data.taxizones} responsiveLayout="scroll">
              <Column field="label" header="Zonename" />
              <Column
                field="polygon"
                header="Polygon"
                body={(rowData) => <InputTextarea value={rowData.polygon} autoResize />}
              />
              <Column field="taxiout" header="Taxiout" body={taxioutTemplate}/>
            </DataTable>
          </div>
          <div className="col">
          <DataTable value={data.capacities} responsiveLayout="scroll">
              <Column field="rwy_designator" header="Runway" />
              <Column
                field="capacity"
                header="Capacity"
              />
              <Column field="alias" header="Alias"/>
            </DataTable>
          </div>
        </div>
      </>
    );
  };

  return (
        <Card>
          <DataTable
            value={airports}
            sortMode="multiple"
            responsiveLayout="scroll"
            loading={loading}
            onRowToggle={(e) => setExpandedRows(e.data)}
            rowExpansionTemplate={rowExpansionTemplate}
            dataKey="icao"
            expandedRows={expandedRows}
          >
            <Column expander style={{ width: "3em" }} />
            <Column field="icao" header="ICAO"></Column>
            <Column
              field="standard_taxitime"
              header="Standard Taxitime"
            ></Column>
            <Column field="taxizones.length" header="Taxizones"></Column>
            <Column field="capacities.length" header="Capacities"></Column>
            <Column body={editButtonTemplate} header="Actions"></Column>
            <Column header="Blocks" body={blocksButtonTemplate} />
            {isAdmin && (
              <Column header="Flush All Pilots" body={deleteAllPilotsTemplate} />
            )}
          </DataTable>
        </Card>
  );
};

export default AirpotsTable;
