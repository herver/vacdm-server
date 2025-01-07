import axios from 'axios';
import User from '@shared/interfaces/user.interface';

async function getUsers(): Promise<User[]> {
  try {
    const response = await axios.get('/api/v1/users');
    return response.data;
  } catch (error) {
    console.error(error);
    throw error;
  }
}

async function updateUser(id: string, updates: Partial<User>): Promise<User> {
  try {
    const response = await axios.patch(`/api/v1/users/${id}`, updates);
    return response.data;
  } catch (error) {
    console.error(error);
    throw error;
  }
}

export default {
  getUsers,
  updateUser
};