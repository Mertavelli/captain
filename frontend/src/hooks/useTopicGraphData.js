import { useEffect, useState } from 'react';
import { createClient } from '@/utils/supabase/client';

export function useTopicGraphData(scope) {
    const [topics, setTopics] = useState([]);
    const [relations, setRelations] = useState([]);
    const supabase = createClient()

    useEffect(() => {
        let isMounted = true;
        async function load() {
            let tq = supabase
                .from('dccts_topics')
                .select('topic_id,title,labels,summary,last_event_ts,updated_at,scope')
                .order('updated_at', { ascending: false })
                .limit(500);

            if (scope) tq = tq.eq('scope', scope);
            const tRes = await tq;
            if (tRes.error) console.error('[topics]', tRes.error);
            const tRows = tRes.data || [];

            let rq = supabase
                .from('dccts_topic_relations')
                .select('topic_id,related_topic_id,relation_type,created_at')
                .order('created_at', { ascending: false })
                .limit(2000);

            if (scope) {
                const inScopeIds = new Set(tRows.map((t) => t.topic_id));
                const rAll = await rq;
                const rRows = (rAll.data || []).filter(
                    (r) => inScopeIds.has(r.topic_id) && inScopeIds.has(r.related_topic_id)
                );
                if (isMounted) {
                    setTopics(tRows);
                    setRelations(rRows);
                }
                return;
            }

            const rRes = await rq;
            if (rRes.error) console.error('[relations]', rRes.error);

            if (isMounted) {
                setTopics(tRows);
                setRelations(rRes.data || []);
            }
        }

        load();
        return () => {
            isMounted = false;
        };
    }, [scope]);

    useEffect(() => {
        const chanTopics = supabase
            .channel('topics@rf')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'dccts_topics' }, (payload) => {
                setTopics((prev) => {
                    const row = payload.new || payload.old;
                    if (payload.eventType === 'DELETE') {
                        return prev.filter((t) => t.topic_id !== row.topic_id);
                    }
                    const idx = prev.findIndex((t) => t.topic_id === row.topic_id);
                    if (idx >= 0) {
                        const cp = prev.slice();
                        cp[idx] = { ...prev[idx], ...row };
                        return cp;
                    }
                    if (scope && row.scope !== scope) return prev;
                    return [row, ...prev];
                });
            })
            .subscribe();

        const chanRel = supabase
            .channel('topic_relations@rf')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'dccts_topic_relations' }, (payload) => {
                setRelations((prev) => {
                    const row = payload.new || payload.old;
                    const key = `${row.topic_id}→${row.related_topic_id}#${row.relation_type}`;
                    if (payload.eventType === 'DELETE') {
                        return prev.filter((r) => `${r.topic_id}→${r.related_topic_id}#${r.relation_type}` !== key);
                    }
                    const idx = prev.findIndex((r) => `${r.topic_id}→${r.related_topic_id}#${r.relation_type}` === key);
                    if (idx >= 0) {
                        const cp = prev.slice();
                        cp[idx] = { ...prev[idx], ...row };
                        return cp;
                    }
                    return [row, ...prev];
                });
            })
            .subscribe();

        const chanEvtTopics = supabase
            .channel('event_topics@rf')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'dccts_event_topics' }, () => { })
            .subscribe();

        return () => {
            supabase.removeChannel(chanTopics);
            supabase.removeChannel(chanRel);
            supabase.removeChannel(chanEvtTopics);
        };
    }, [scope]);

    return { topics, relations };
}