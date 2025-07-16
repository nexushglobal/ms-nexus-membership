export interface MembershipDates {
  startDate: Date;
  endDate: Date;
}

export function calculateMembershipDates(startDate?: Date): MembershipDates {
  const start = startDate || new Date();
  const end = new Date(start);

  // Agregar un mes
  end.setMonth(end.getMonth() + 1);

  // Manejar casos especiales donde el día no existe en el mes siguiente
  // Ejemplo: 31 de enero -> 28/29 de febrero
  const originalDay = start.getDate();
  const maxDayInEndMonth = new Date(
    end.getFullYear(),
    end.getMonth() + 1,
    0,
  ).getDate();

  if (originalDay > maxDayInEndMonth) {
    end.setDate(maxDayInEndMonth);
  } else {
    end.setDate(originalDay);
  }

  return {
    startDate: start,
    endDate: end,
  };
}
