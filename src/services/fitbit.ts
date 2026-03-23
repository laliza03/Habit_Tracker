import axios from 'axios';

export const fetchFitbitSteps = async (accessToken: string, userId: string, date: string) => {
  try {
    const response = await axios.get(`https://api.fitbit.com/1/user/${userId}/activities/date/${date}.json`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
    return response.data.summary.steps || 0;
  } catch (error) {
    console.error('Error fetching Fitbit steps:', error);
    return 0;
  }
};

export const fetchFitbitWater = async (accessToken: string, userId: string, date: string) => {
  try {
    const response = await axios.get(`https://api.fitbit.com/1/user/${userId}/foods/log/water/date/${date}.json`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
    return response.data.summary.water || 0;
  } catch (error) {
    console.error('Error fetching Fitbit water:', error);
    return 0;
  }
};

export const fetchFitbitCalories = async (accessToken: string, userId: string, date: string) => {
  try {
    const response = await axios.get(`https://api.fitbit.com/1/user/${userId}/foods/log/date/${date}.json`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
    return response.data.summary.calories || 0;
  } catch (error) {
    console.error('Error fetching Fitbit calories:', error);
    return 0;
  }
};
