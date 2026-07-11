export type StudyPlanOwnerUid = string | null | undefined;

export const isHydratedStudyPlanOwner = (
  hydratedOwnerUid: StudyPlanOwnerUid,
  activeOwnerUid: string | null,
) => hydratedOwnerUid !== undefined && hydratedOwnerUid === activeOwnerUid;

export const isStudyPlanOwnerReady = ({
  authLoading,
  persistenceReady,
  hydratedOwnerUid,
  activeOwnerUid,
}: {
  authLoading: boolean;
  persistenceReady: boolean;
  hydratedOwnerUid: StudyPlanOwnerUid;
  activeOwnerUid: string | null;
}) => !authLoading
  && persistenceReady
  && isHydratedStudyPlanOwner(hydratedOwnerUid, activeOwnerUid);
