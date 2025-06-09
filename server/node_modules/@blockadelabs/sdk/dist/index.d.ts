import { z } from 'zod';

declare const getSkyboxStylesResponse: z.ZodArray<z.ZodObject<{
    id: z.ZodNumber;
    name: z.ZodString;
    'max-char': z.ZodString;
    image: z.ZodUnion<[z.ZodString, z.ZodNull]>;
    sort_order: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    id: number;
    name: string;
    'max-char': string;
    image: string | null;
    sort_order: number;
}, {
    id: number;
    name: string;
    'max-char': string;
    image: string | null;
    sort_order: number;
}>, "many">;
declare const generateSkyboxRequest: z.ZodObject<{
    prompt: z.ZodString;
    negative_text: z.ZodOptional<z.ZodString>;
    enhance_prompt: z.ZodOptional<z.ZodBoolean>;
    seed: z.ZodOptional<z.ZodNumber>;
    skybox_style_id: z.ZodOptional<z.ZodNumber>;
    remix_id: z.ZodOptional<z.ZodNumber>;
    remix_obfuscated_id: z.ZodOptional<z.ZodString>;
    control_image: z.ZodOptional<z.ZodAny>;
    control_model: z.ZodOptional<z.ZodString>;
    return_depth: z.ZodOptional<z.ZodBoolean>;
    webhook_url: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    prompt: string;
    negative_text?: string | undefined;
    enhance_prompt?: boolean | undefined;
    seed?: number | undefined;
    skybox_style_id?: number | undefined;
    remix_id?: number | undefined;
    remix_obfuscated_id?: string | undefined;
    control_image?: any;
    control_model?: string | undefined;
    return_depth?: boolean | undefined;
    webhook_url?: string | undefined;
}, {
    prompt: string;
    negative_text?: string | undefined;
    enhance_prompt?: boolean | undefined;
    seed?: number | undefined;
    skybox_style_id?: number | undefined;
    remix_id?: number | undefined;
    remix_obfuscated_id?: string | undefined;
    control_image?: any;
    control_model?: string | undefined;
    return_depth?: boolean | undefined;
    webhook_url?: string | undefined;
}>;
declare const generateSkyboxResponse: z.ZodObject<{
    id: z.ZodNumber;
    skybox_style_id: z.ZodNumber;
    skybox_style_name: z.ZodString;
    status: z.ZodString;
    type: z.ZodString;
    queue_position: z.ZodNumber;
    file_url: z.ZodString;
    thumb_url: z.ZodString;
    title: z.ZodString;
    user_id: z.ZodNumber;
    username: z.ZodString;
    error_message: z.ZodUnion<[z.ZodNull, z.ZodAny]>;
    obfuscated_id: z.ZodString;
    pusher_channel: z.ZodString;
    pusher_event: z.ZodString;
    created_at: z.ZodUnion<[z.ZodString, z.ZodDate]>;
    updated_at: z.ZodUnion<[z.ZodString, z.ZodDate]>;
    skybox_id: z.ZodOptional<z.ZodNumber>;
    skybox_name: z.ZodOptional<z.ZodString>;
    prompt: z.ZodOptional<z.ZodString>;
    seed: z.ZodOptional<z.ZodNumber>;
    negative_text: z.ZodOptional<z.ZodString>;
    depth_map_url: z.ZodOptional<z.ZodString>;
    remix_imagine_id: z.ZodOptional<z.ZodNullable<z.ZodUnion<[z.ZodString, z.ZodNumber]>>>;
}, "strip", z.ZodTypeAny, {
    status: string;
    type: string;
    id: number;
    skybox_style_id: number;
    skybox_style_name: string;
    queue_position: number;
    file_url: string;
    thumb_url: string;
    title: string;
    user_id: number;
    username: string;
    obfuscated_id: string;
    pusher_channel: string;
    pusher_event: string;
    created_at: (string | Date) & (string | Date | undefined);
    updated_at: (string | Date) & (string | Date | undefined);
    error_message?: any;
    skybox_id?: number | undefined;
    skybox_name?: string | undefined;
    prompt?: string | undefined;
    seed?: number | undefined;
    negative_text?: string | undefined;
    depth_map_url?: string | undefined;
    remix_imagine_id?: string | number | null | undefined;
}, {
    status: string;
    type: string;
    id: number;
    skybox_style_id: number;
    skybox_style_name: string;
    queue_position: number;
    file_url: string;
    thumb_url: string;
    title: string;
    user_id: number;
    username: string;
    obfuscated_id: string;
    pusher_channel: string;
    pusher_event: string;
    created_at: (string | Date) & (string | Date | undefined);
    updated_at: (string | Date) & (string | Date | undefined);
    error_message?: any;
    skybox_id?: number | undefined;
    skybox_name?: string | undefined;
    prompt?: string | undefined;
    seed?: number | undefined;
    negative_text?: string | undefined;
    depth_map_url?: string | undefined;
    remix_imagine_id?: string | number | null | undefined;
}>;

declare const getImagineByIdRequest: z.ZodObject<{
    id: z.ZodUnion<[z.ZodString, z.ZodNumber]>;
}, "strip", z.ZodTypeAny, {
    id: string | number;
}, {
    id: string | number;
}>;
declare const getImagineByIdResponse: z.ZodObject<{
    id: z.ZodNumber;
    obfuscated_id: z.ZodString;
    user_id: z.ZodNumber;
    username: z.ZodString;
    status: z.ZodString;
    queue_position: z.ZodNumber;
    pusher_channel: z.ZodString;
    pusher_event: z.ZodString;
    error_message: z.ZodUnion<[z.ZodNull, z.ZodAny]>;
    type: z.ZodString;
    title: z.ZodString;
    prompt: z.ZodOptional<z.ZodString>;
    seed: z.ZodOptional<z.ZodNumber>;
    skybox_style_id: z.ZodOptional<z.ZodNumber>;
    skybox_style_name: z.ZodOptional<z.ZodString>;
    file_url: z.ZodString;
    thumb_url: z.ZodString;
    depth_map_url: z.ZodOptional<z.ZodString>;
    created_at: z.ZodUnion<[z.ZodString, z.ZodDate]>;
    updated_at: z.ZodUnion<[z.ZodString, z.ZodDate]>;
    dispatched_at: z.ZodUnion<[z.ZodString, z.ZodDate]>;
    processing_at: z.ZodUnion<[z.ZodString, z.ZodDate]>;
    completed_at: z.ZodUnion<[z.ZodString, z.ZodDate]>;
}, "strip", z.ZodTypeAny, {
    status: string;
    type: string;
    id: number;
    queue_position: number;
    file_url: string;
    thumb_url: string;
    title: string;
    user_id: number;
    username: string;
    obfuscated_id: string;
    pusher_channel: string;
    pusher_event: string;
    created_at: (string | Date) & (string | Date | undefined);
    updated_at: (string | Date) & (string | Date | undefined);
    dispatched_at: (string | Date) & (string | Date | undefined);
    processing_at: (string | Date) & (string | Date | undefined);
    completed_at: (string | Date) & (string | Date | undefined);
    error_message?: any;
    prompt?: string | undefined;
    seed?: number | undefined;
    skybox_style_id?: number | undefined;
    skybox_style_name?: string | undefined;
    depth_map_url?: string | undefined;
}, {
    status: string;
    type: string;
    id: number;
    queue_position: number;
    file_url: string;
    thumb_url: string;
    title: string;
    user_id: number;
    username: string;
    obfuscated_id: string;
    pusher_channel: string;
    pusher_event: string;
    created_at: (string | Date) & (string | Date | undefined);
    updated_at: (string | Date) & (string | Date | undefined);
    dispatched_at: (string | Date) & (string | Date | undefined);
    processing_at: (string | Date) & (string | Date | undefined);
    completed_at: (string | Date) & (string | Date | undefined);
    error_message?: any;
    prompt?: string | undefined;
    seed?: number | undefined;
    skybox_style_id?: number | undefined;
    skybox_style_name?: string | undefined;
    depth_map_url?: string | undefined;
}>;
declare const getImagineByObfuscatedIdRequest: z.ZodObject<{
    obfuscated_id: z.ZodUnion<[z.ZodString, z.ZodNumber]>;
}, "strip", z.ZodTypeAny, {
    obfuscated_id: string | number;
}, {
    obfuscated_id: string | number;
}>;
declare const getImagineByObfuscatedIdResponse: z.ZodObject<{
    id: z.ZodNumber;
    obfuscated_id: z.ZodString;
    user_id: z.ZodNumber;
    username: z.ZodString;
    status: z.ZodString;
    queue_position: z.ZodNumber;
    pusher_channel: z.ZodString;
    pusher_event: z.ZodString;
    error_message: z.ZodUnion<[z.ZodNull, z.ZodAny]>;
    type: z.ZodString;
    title: z.ZodString;
    prompt: z.ZodOptional<z.ZodString>;
    seed: z.ZodOptional<z.ZodNumber>;
    skybox_style_id: z.ZodOptional<z.ZodNumber>;
    skybox_style_name: z.ZodOptional<z.ZodString>;
    file_url: z.ZodString;
    thumb_url: z.ZodString;
    depth_map_url: z.ZodOptional<z.ZodString>;
    created_at: z.ZodUnion<[z.ZodString, z.ZodDate]>;
    updated_at: z.ZodUnion<[z.ZodString, z.ZodDate]>;
    dispatched_at: z.ZodUnion<[z.ZodString, z.ZodDate]>;
    processing_at: z.ZodUnion<[z.ZodString, z.ZodDate]>;
    completed_at: z.ZodUnion<[z.ZodString, z.ZodDate]>;
}, "strip", z.ZodTypeAny, {
    status: string;
    type: string;
    id: number;
    queue_position: number;
    file_url: string;
    thumb_url: string;
    title: string;
    user_id: number;
    username: string;
    obfuscated_id: string;
    pusher_channel: string;
    pusher_event: string;
    created_at: (string | Date) & (string | Date | undefined);
    updated_at: (string | Date) & (string | Date | undefined);
    dispatched_at: (string | Date) & (string | Date | undefined);
    processing_at: (string | Date) & (string | Date | undefined);
    completed_at: (string | Date) & (string | Date | undefined);
    error_message?: any;
    prompt?: string | undefined;
    seed?: number | undefined;
    skybox_style_id?: number | undefined;
    skybox_style_name?: string | undefined;
    depth_map_url?: string | undefined;
}, {
    status: string;
    type: string;
    id: number;
    queue_position: number;
    file_url: string;
    thumb_url: string;
    title: string;
    user_id: number;
    username: string;
    obfuscated_id: string;
    pusher_channel: string;
    pusher_event: string;
    created_at: (string | Date) & (string | Date | undefined);
    updated_at: (string | Date) & (string | Date | undefined);
    dispatched_at: (string | Date) & (string | Date | undefined);
    processing_at: (string | Date) & (string | Date | undefined);
    completed_at: (string | Date) & (string | Date | undefined);
    error_message?: any;
    prompt?: string | undefined;
    seed?: number | undefined;
    skybox_style_id?: number | undefined;
    skybox_style_name?: string | undefined;
    depth_map_url?: string | undefined;
}>;
declare const getImagineHistoryRequest: z.ZodOptional<z.ZodObject<{
    status: z.ZodOptional<z.ZodString>;
    limit: z.ZodOptional<z.ZodNumber>;
    offset: z.ZodOptional<z.ZodNumber>;
    order: z.ZodOptional<z.ZodUnion<[z.ZodLiteral<"ASC">, z.ZodLiteral<"DESC">]>>;
    imagine_id: z.ZodOptional<z.ZodNumber>;
    query: z.ZodOptional<z.ZodString>;
    generator: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    status?: string | undefined;
    limit?: number | undefined;
    offset?: number | undefined;
    order?: "ASC" | "DESC" | undefined;
    imagine_id?: number | undefined;
    query?: string | undefined;
    generator?: string | undefined;
}, {
    status?: string | undefined;
    limit?: number | undefined;
    offset?: number | undefined;
    order?: "ASC" | "DESC" | undefined;
    imagine_id?: number | undefined;
    query?: string | undefined;
    generator?: string | undefined;
}>>;
declare const getImagineHistoryResponse: z.ZodObject<{
    data: z.ZodArray<z.ZodObject<{
        id: z.ZodNumber;
        obfuscated_id: z.ZodString;
        user_id: z.ZodNumber;
        username: z.ZodString;
        status: z.ZodString;
        queue_position: z.ZodNumber;
        pusher_channel: z.ZodString;
        pusher_event: z.ZodString;
        error_message: z.ZodUnion<[z.ZodNull, z.ZodAny]>;
        type: z.ZodString;
        title: z.ZodString;
        prompt: z.ZodOptional<z.ZodString>;
        seed: z.ZodOptional<z.ZodNumber>;
        skybox_style_id: z.ZodOptional<z.ZodNumber>;
        skybox_style_name: z.ZodOptional<z.ZodString>;
        file_url: z.ZodString;
        thumb_url: z.ZodString;
        depth_map_url: z.ZodOptional<z.ZodString>;
        created_at: z.ZodUnion<[z.ZodString, z.ZodDate]>;
        updated_at: z.ZodUnion<[z.ZodString, z.ZodDate]>;
        dispatched_at: z.ZodUnion<[z.ZodString, z.ZodDate]>;
        processing_at: z.ZodUnion<[z.ZodString, z.ZodDate]>;
        completed_at: z.ZodUnion<[z.ZodString, z.ZodDate]>;
    }, "strip", z.ZodTypeAny, {
        status: string;
        type: string;
        id: number;
        queue_position: number;
        file_url: string;
        thumb_url: string;
        title: string;
        user_id: number;
        username: string;
        obfuscated_id: string;
        pusher_channel: string;
        pusher_event: string;
        created_at: (string | Date) & (string | Date | undefined);
        updated_at: (string | Date) & (string | Date | undefined);
        dispatched_at: (string | Date) & (string | Date | undefined);
        processing_at: (string | Date) & (string | Date | undefined);
        completed_at: (string | Date) & (string | Date | undefined);
        error_message?: any;
        prompt?: string | undefined;
        seed?: number | undefined;
        skybox_style_id?: number | undefined;
        skybox_style_name?: string | undefined;
        depth_map_url?: string | undefined;
    }, {
        status: string;
        type: string;
        id: number;
        queue_position: number;
        file_url: string;
        thumb_url: string;
        title: string;
        user_id: number;
        username: string;
        obfuscated_id: string;
        pusher_channel: string;
        pusher_event: string;
        created_at: (string | Date) & (string | Date | undefined);
        updated_at: (string | Date) & (string | Date | undefined);
        dispatched_at: (string | Date) & (string | Date | undefined);
        processing_at: (string | Date) & (string | Date | undefined);
        completed_at: (string | Date) & (string | Date | undefined);
        error_message?: any;
        prompt?: string | undefined;
        seed?: number | undefined;
        skybox_style_id?: number | undefined;
        skybox_style_name?: string | undefined;
        depth_map_url?: string | undefined;
    }>, "many">;
    totalCount: z.ZodNumber;
    has_more: z.ZodBoolean;
}, "strip", z.ZodTypeAny, {
    data: {
        status: string;
        type: string;
        id: number;
        queue_position: number;
        file_url: string;
        thumb_url: string;
        title: string;
        user_id: number;
        username: string;
        obfuscated_id: string;
        pusher_channel: string;
        pusher_event: string;
        created_at: (string | Date) & (string | Date | undefined);
        updated_at: (string | Date) & (string | Date | undefined);
        dispatched_at: (string | Date) & (string | Date | undefined);
        processing_at: (string | Date) & (string | Date | undefined);
        completed_at: (string | Date) & (string | Date | undefined);
        error_message?: any;
        prompt?: string | undefined;
        seed?: number | undefined;
        skybox_style_id?: number | undefined;
        skybox_style_name?: string | undefined;
        depth_map_url?: string | undefined;
    }[];
    totalCount: number;
    has_more: boolean;
}, {
    data: {
        status: string;
        type: string;
        id: number;
        queue_position: number;
        file_url: string;
        thumb_url: string;
        title: string;
        user_id: number;
        username: string;
        obfuscated_id: string;
        pusher_channel: string;
        pusher_event: string;
        created_at: (string | Date) & (string | Date | undefined);
        updated_at: (string | Date) & (string | Date | undefined);
        dispatched_at: (string | Date) & (string | Date | undefined);
        processing_at: (string | Date) & (string | Date | undefined);
        completed_at: (string | Date) & (string | Date | undefined);
        error_message?: any;
        prompt?: string | undefined;
        seed?: number | undefined;
        skybox_style_id?: number | undefined;
        skybox_style_name?: string | undefined;
        depth_map_url?: string | undefined;
    }[];
    totalCount: number;
    has_more: boolean;
}>;
declare const cancelImagineRequest: z.ZodObject<{
    id: z.ZodUnion<[z.ZodString, z.ZodNumber]>;
}, "strip", z.ZodTypeAny, {
    id: string | number;
}, {
    id: string | number;
}>;
declare const cancelImagineResponse: z.ZodObject<{
    success: z.ZodBoolean;
}, "strip", z.ZodTypeAny, {
    success: boolean;
}, {
    success: boolean;
}>;
declare const cancelAllPendingImaginesResponse: z.ZodObject<{
    success: z.ZodBoolean;
}, "strip", z.ZodTypeAny, {
    success: boolean;
}, {
    success: boolean;
}>;
declare const deleteImagineRequest: z.ZodObject<{
    id: z.ZodUnion<[z.ZodString, z.ZodNumber]>;
}, "strip", z.ZodTypeAny, {
    id: string | number;
}, {
    id: string | number;
}>;
declare const deleteImagineResponse: z.ZodObject<{
    success: z.ZodString;
    id: z.ZodString;
}, "strip", z.ZodTypeAny, {
    id: string;
    success: string;
}, {
    id: string;
    success: string;
}>;

type BlockadeLabsSdkConstructor = {
    api_key: string;
};
declare class BlockadeLabsSdk {
    private api_key;
    private api;
    constructor({ api_key }: BlockadeLabsSdkConstructor);
    getSkyboxStyles(): Promise<z.infer<typeof getSkyboxStylesResponse>>;
    generateSkybox(input: z.infer<typeof generateSkyboxRequest>): Promise<z.infer<typeof generateSkyboxResponse>>;
    getImagineById(input: z.infer<typeof getImagineByIdRequest>): Promise<z.infer<typeof getImagineByIdResponse>>;
    getImagineByObfuscatedId(input: z.infer<typeof getImagineByObfuscatedIdRequest>): Promise<z.infer<typeof getImagineByObfuscatedIdResponse>>;
    getImagineHistory(input?: z.infer<typeof getImagineHistoryRequest>): Promise<z.infer<typeof getImagineHistoryResponse>>;
    cancelImagine(input: z.infer<typeof cancelImagineRequest>): Promise<z.infer<typeof cancelImagineResponse>>;
    cancelAllPendingImagines(): Promise<z.infer<typeof cancelAllPendingImaginesResponse>>;
    deleteImagine(input: z.infer<typeof deleteImagineRequest>): Promise<z.infer<typeof deleteImagineResponse>>;
}

export { BlockadeLabsSdk };
