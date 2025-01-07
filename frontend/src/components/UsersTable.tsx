import { useState, useEffect, useRef } from "react";
import { DataTable } from "primereact/datatable";
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

    return `${division}/${region}/${subdivision}`;
  };

  const filters = {

  }

  if (loading) {
    return <Loading />;
  }

  return (
    <div className="grid">
      <Toast ref={toast} />
      <div className="col"></div>
      <div className="col-8">
        <Card>
          <DataTable
            value={users}
            responsiveLayout="scroll"
            loading={loading}
            paginator showGridlines rows={20}
          >
            <Column field="apidata.cid" header="CID" sortable />
            <Column field="apidata.personal.name_full" header="Name" sortable />
            <Column body={locationTemplate} header="ACC" sortable />
            <Column field="apidata.vatsim.rating.short" header="Rating" sortable />
            <Column field="vacdm.atc" header="ATC" body={atcTemplate} />
            <Column field="vacdm.admin" header="Admin" body={adminTemplate} />
          </DataTable>
        </Card>
      </div>
      <div className="col"></div>
    </div>
  );
};

export default UsersTable;