import { EcfmpMeasure } from "@shared/interfaces/ecfmp.interface";
import axios from "axios";

export async function getAllMeasures(): Promise<EcfmpMeasure[]> {
  try {
    const measures = await axios.get<EcfmpMeasure[]>(
      "/api/v1/measures"
    );

    return measures.data;
  } catch (error) {
    throw error;
  }
}

export async function setMeasureEnable(measureId: number, enabled: boolean): Promise<EcfmpMeasure> {
  try {
    const measure = await axios.patch<EcfmpMeasure>(`/api/v1/measures/${measureId}`, {
      id: measureId,
      enabled: enabled,
    });

    return measure.data;
  } catch (error) {
    throw error;
  }
}

export default { getAllMeasures, setMeasureEnable };
