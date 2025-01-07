import { useState, useEffect, useRef } from "react";
import { DataTable } from "primereact/datatable";
import { InputText } from 'primereact/inputtext';
import { FilterMatchMode } from "primereact/api";
import { Button } from "primereact/button";
import { Column } from "primereact/column";
import { Card } from "primereact/card";
import UserService from "../services/UserService"; 
import User from "@shared/interfaces/user.interface";
import Loading from "./Loading";
import { Toast } from 'primereact/toast';
import { ToggleButton } from 'primereact/togglebutton';

const UsersTable = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    global: {value: null, matchMode: FilterMatchMode.CONTAINS}
  });
  const [globalFilterValue, setGlobalFilterValue] = useState('');
  const toast = useRef<Toast>(null);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const data = await UserService.getUsers();
      setUsers(data);
      setLoading(false);
    } catch (e) {
      console.error(e);
      toast.current?.show({
        severity: 'error',
        summary: 'Error',
        detail: 'Failed to load users'
      });
    }
  }

  const updateUserStatus = async (userId: string, field: string, value: boolean) => {
    try {
      const user = users.find(u => u._id === userId);
      if (!user) return;
      
      const updates = {
        vacdm: {
          ...user.vacdm,
          [field]: value
        }
      };
      await UserService.updateUser(userId, updates);
      loadData();
      
      toast.current?.show({
        severity: 'success',
        summary: 'Success',
        detail: 'User updated successfully'
      });
    } catch (e) {
      toast.current?.show({
        severity: 'error',
        summary: 'Error',
        detail: 'Failed to update user'
      });
    }
  };

  const atcTemplate = (rowData: User) => {
    return (
      <ToggleButton
        checked={rowData.vacdm.atc}
        onChange={(e) => updateUserStatus(rowData._id, 'atc', e.value)}
      />
    );
  };

  const adminTemplate = (rowData: User) => {
    return (
      <ToggleButton
        checked={rowData.vacdm.admin}
        onChange={(e) => updateUserStatus(rowData._id, 'admin', e.value)}
      />
    );
  };

  const locationTemplate = (rowData: User) => {
    const division = rowData.apidata.vatsim.division.id || 'None';
    const region = rowData.apidata.vatsim.region.id || 'None';
    const subdivision = rowData.apidata.vatsim.subdivision.id || 'None';

    return `${subdivision}/${region}/${division}`;
  };

  if (loading) {
    return <Loading />;
  }

  // Client-side filtering
  const handleGlobalFilterChange = (e: any) => {
    const value = e.target.value;
    setGlobalFilterValue(value);
    setFilters({
      ...filters,
      global: { value: value, matchMode: FilterMatchMode.CONTAINS }
    });
  };

  const clearFilters = () => {
    setGlobalFilterValue('');
    setFilters({
      global: { value: null, matchMode: FilterMatchMode.CONTAINS },
    });
  };

    const searchHeader = (
    <div className="flex justify-content-end">
      <span className="p-input-icon-left">
        <i className="pi pi-search" />
        <InputText
          value={globalFilterValue}
          onChange={handleGlobalFilterChange}
          placeholder="Search..."
        />
        <Button label="Clear" icon="pi pi-times" onClick={clearFilters} className="p-button-outlined" />
      </span>
    </div>
  );

  return (
    <div className="grid">
      <Toast ref={toast} />
      <div className="col"></div>
      <div className="col-8">
        <Card>
          <DataTable
            value={users}
            stripedRows
            loading={loading}
            paginator rows={10}
            showGridlines size="small"
            header={searchHeader}
            filters={filters}
            emptyMessage="No users found"
          >
            <Column field="apidata.cid" header="CID" sortable />
            <Column field="apidata.personal.name_full" header="Name" sortable />
            <Column field="apidata.vatsim.rating.short" header="Rating" sortable />
            <Column body={locationTemplate} header="ACC" />
            <Column field="vacdm.atc" header="ATC" body={atcTemplate} />
            <Column field="vacdm.admin" header="Admin" body={adminTemplate} />

            <Column field="apidata.vatsim.region.id" header="Region" hidden />
            <Column field="apidata.vatsim.division.id" header="Div" hidden />
            <Column field="apidata.vatsim.subdivision.id" header="Subdiv" hidden/>
          </DataTable>
        </Card>
      </div>
      <div className="col"></div>
    </div>
  );
};

export default UsersTable;