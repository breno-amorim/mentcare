import { useState } from 'react'

/** Instante fixado na montagem do componente (render puro e testável). */
export const useNow = (): Date => useState(() => new Date())[0]
