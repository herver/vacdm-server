import userModel, { UserDocument } from '../models/user.model';

// Only returns users that are ATC (VATSIM rating > 1, OBS)
export async function getAllUsers(): Promise<UserDocument[]> {
  try {
    const users = await userModel.find({
      'apidata.vatsim.rating.id': { $gt: 1 }
    }).exec();
    return users;
  } catch (e) {
    throw e;
  }
}

export async function updateUser(userId: string, updates: Partial<UserDocument>): Promise<UserDocument> {
  try {
    const user = await userModel.findByIdAndUpdate(
      userId,
      { $set: updates },
      { new: true }
    ).exec();
    if (!user) {
      throw new Error('User not found');
    }
    return user;
  } catch (e) {
    throw e;
  }
}

export default {
  getAllUsers,
  updateUser
};